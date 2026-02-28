/**
 * Discovery Integration Types
 *
 * Type definitions for discovery data ingestion from various sources
 * (SCCM, Jamf, Tanium) and asset matching operations.
 *
 * Requirements:
 * - 7.1: Ingest asset data from SCCM, Jamf, Tanium, and custom discovery sources
 * - 7.2: Match discovery records to existing assets by serial_number and mac_address
 */

import type { ISODateString, UUID } from '@ams/types';

/**
 * Discovery source types
 */
export type DiscoverySourceType = 'SCCM' | 'JAMF' | 'TANIUM' | 'CUSTOM';

/**
 * Discovery record status
 */
export type DiscoveryRecordStatus = 
  | 'PENDING'      // Awaiting processing
  | 'MATCHED'      // Matched to existing asset
  | 'CREATED'      // New asset created
  | 'FAILED'       // Processing failed
  | 'IGNORED';     // Ignored (e.g., duplicate, invalid data)

/**
 * Base discovery record from any source
 */
export interface DiscoveryRecord {
  readonly discoveryRecordId: UUID;
  readonly sourceType: DiscoverySourceType;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly serialNumber?: string;
  readonly macAddress?: string;
  readonly hostname?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly operatingSystem?: string;
  readonly osVersion?: string;
  readonly ipAddress?: string;
  readonly lastSeen: ISODateString;
  readonly discoveredAt: ISODateString;
  readonly status: DiscoveryRecordStatus;
  readonly matchedAssetId?: UUID;
  readonly createdAssetId?: UUID;
  readonly errorMessage?: string;
  readonly rawData: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * SCCM (Microsoft System Center Configuration Manager) payload
 * Contains Windows device discovery data
 */
export interface SCCMPayload {
  readonly devices: readonly SCCMDevice[];
  readonly collectionId?: string;
  readonly collectionName?: string;
  readonly syncTimestamp: ISODateString;
}

/**
 * SCCM device record
 */
export interface SCCMDevice {
  readonly resourceId: string;
  readonly name: string;
  readonly serialNumber?: string;
  readonly macAddresses?: readonly string[];
  readonly ipAddresses?: readonly string[];
  readonly manufacturer?: string;
  readonly model?: string;
  readonly operatingSystem?: string;
  readonly operatingSystemVersion?: string;
  readonly lastLogonUser?: string;
  readonly lastActiveTime?: ISODateString;
  readonly clientVersion?: string;
  readonly siteName?: string;
  readonly domain?: string;
  readonly isVirtualMachine?: boolean;
  readonly processorName?: string;
  readonly processorCount?: number;
  readonly totalPhysicalMemoryMB?: number;
  readonly totalDiskSpaceGB?: number;
}

/**
 * Jamf (Apple device management) payload
 * Contains macOS and iOS device discovery data
 */
export interface JamfPayload {
  readonly computers?: readonly JamfComputer[];
  readonly mobileDevices?: readonly JamfMobileDevice[];
  readonly syncTimestamp: ISODateString;
}

/**
 * Jamf computer record (macOS devices)
 */
export interface JamfComputer {
  readonly id: number;
  readonly name: string;
  readonly serialNumber: string;
  readonly macAddress?: string;
  readonly altMacAddress?: string;
  readonly ipAddress?: string;
  readonly lastReportedIp?: string;
  readonly make?: string;
  readonly model?: string;
  readonly modelIdentifier?: string;
  readonly osName?: string;
  readonly osVersion?: string;
  readonly osBuild?: string;
  readonly username?: string;
  readonly realname?: string;
  readonly emailAddress?: string;
  readonly department?: string;
  readonly building?: string;
  readonly room?: string;
  readonly lastContactTime?: ISODateString;
  readonly lastEnrolledDate?: ISODateString;
  readonly managed?: boolean;
  readonly supervised?: boolean;
  readonly processorType?: string;
  readonly processorSpeed?: number;
  readonly numberOfProcessors?: number;
  readonly numberOfCores?: number;
  readonly totalRamMb?: number;
  readonly availableRamMb?: number;
  readonly bootDriveCapacityMb?: number;
  readonly bootDriveAvailableMb?: number;
}

/**
 * Jamf mobile device record (iOS/iPadOS devices)
 */
export interface JamfMobileDevice {
  readonly id: number;
  readonly name: string;
  readonly serialNumber: string;
  readonly wifiMacAddress?: string;
  readonly bluetoothMacAddress?: string;
  readonly ipAddress?: string;
  readonly model?: string;
  readonly modelIdentifier?: string;
  readonly modelDisplay?: string;
  readonly osType?: string;
  readonly osVersion?: string;
  readonly osBuild?: string;
  readonly username?: string;
  readonly realname?: string;
  readonly emailAddress?: string;
  readonly department?: string;
  readonly building?: string;
  readonly room?: string;
  readonly lastInventoryUpdate?: ISODateString;
  readonly managed?: boolean;
  readonly supervised?: boolean;
  readonly capacityMb?: number;
  readonly availableMb?: number;
}

/**
 * Tanium (endpoint management) payload
 * Contains cross-platform endpoint discovery data
 */
export interface TaniumPayload {
  readonly endpoints: readonly TaniumEndpoint[];
  readonly questionId?: string;
  readonly syncTimestamp: ISODateString;
}

/**
 * Tanium endpoint record
 */
export interface TaniumEndpoint {
  readonly computerName: string;
  readonly computerID: string;
  readonly serialNumber?: string;
  readonly macAddresses?: readonly string[];
  readonly ipAddresses?: readonly string[];
  readonly manufacturer?: string;
  readonly model?: string;
  readonly chassisType?: string;
  readonly operatingSystem?: string;
  readonly osGeneration?: string;
  readonly servicePack?: string;
  readonly domainName?: string;
  readonly lastLoggedInUser?: string;
  readonly lastRebootDate?: ISODateString;
  readonly lastSeenDate?: ISODateString;
  readonly isVirtual?: boolean;
  readonly cpuDetails?: string;
  readonly totalPhysicalMemoryMB?: number;
  readonly diskDrives?: readonly {
    readonly name: string;
    readonly sizeMB: number;
    readonly freeSpaceMB: number;
  }[];
  readonly installedSoftware?: readonly {
    readonly name: string;
    readonly version: string;
    readonly vendor?: string;
  }[];
}

/**
 * Ingestion result for a single discovery source
 */
export interface IngestionResult {
  readonly sourceType: DiscoverySourceType;
  readonly sourceName: string;
  readonly syncTimestamp: ISODateString;
  readonly totalRecords: number;
  readonly matchedCount: number;
  readonly createdCount: number;
  readonly failedCount: number;
  readonly ignoredCount: number;
  readonly records: readonly DiscoveryRecordResult[];
  readonly errors: readonly IngestionError[];
  readonly processingTimeMs: number;
}

/**
 * Result for a single discovery record
 */
export interface DiscoveryRecordResult {
  readonly sourceId: string;
  readonly serialNumber?: string;
  readonly macAddress?: string;
  readonly hostname?: string;
  readonly status: DiscoveryRecordStatus;
  readonly assetId?: UUID;
  readonly matchType?: 'SERIAL_NUMBER' | 'MAC_ADDRESS' | 'HOSTNAME';
  readonly errorMessage?: string;
}

/**
 * Ingestion error details
 */
export interface IngestionError {
  readonly sourceId: string;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly timestamp: ISODateString;
}

/**
 * Asset match result
 */
export interface AssetMatchResult {
  readonly matched: boolean;
  readonly assetId?: UUID;
  readonly matchType?: 'SERIAL_NUMBER' | 'MAC_ADDRESS';
  readonly confidence: number; // 0-100
}

/**
 * Create asset from discovery request
 */
export interface CreateAssetFromDiscoveryRequest {
  readonly discoveryRecord: DiscoveryRecord;
  readonly normalizedManufacturer?: string;
  readonly normalizedModel?: string;
  readonly manufacturerId?: UUID;
  readonly modelId?: UUID;
}

/**
 * Discovery reconciliation report
 */
export interface DiscoveryReconciliationReport {
  readonly sourceType: DiscoverySourceType;
  readonly sourceName: string;
  readonly reportDate: ISODateString;
  readonly totalDiscoveryRecords: number;
  readonly matchedToAssets: number;
  readonly unmatchedRecords: number;
  readonly staleAssets: number; // Assets not seen in discovery
  readonly newAssetsCreated: number;
  readonly lastSyncTimestamp?: ISODateString;
}

/**
 * Discovery source configuration
 */
export interface DiscoverySourceConfig {
  readonly sourceId: UUID;
  readonly sourceType: DiscoverySourceType;
  readonly sourceName: string;
  readonly isActive: boolean;
  readonly autoCreateAssets: boolean;
  readonly matchBySerialNumber: boolean;
  readonly matchByMacAddress: boolean;
  readonly syncIntervalMinutes: number;
  readonly lastSyncAt?: ISODateString;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}
