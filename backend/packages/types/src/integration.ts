/**
 * Integration Types
 *
 * Shared type definitions for integration service.
 * Consolidates types from discovery, ERP, and vendor service definitions.
 */

import type { ISODateString, UUID } from './common';

// Discovery types
export type DiscoverySourceType = 'SCCM' | 'JAMF' | 'TANIUM';
export type DiscoveryRecordStatus = 'MATCHED' | 'CREATED' | 'FAILED' | 'IGNORED';

export interface DiscoveryRecord {
  readonly recordId: UUID;
  readonly sourceType: DiscoverySourceType;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly hostname?: string;
  readonly serialNumber?: string;
  readonly macAddress?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly operatingSystem?: string;
  readonly osVersion?: string;
  readonly ipAddress?: string;
  readonly lastSeen: ISODateString;
  readonly status: DiscoveryRecordStatus;
  readonly matchedAssetId?: UUID;
  readonly createdAt: ISODateString;
}

export interface IngestionResult {
  readonly sourceType: DiscoverySourceType;
  readonly sourceName: string;
  readonly syncTimestamp: ISODateString;
  readonly totalRecords: number;
  readonly matchedCount: number;
  readonly createdCount: number;
  readonly failedCount: number;
  readonly ignoredCount: number;
  readonly processingTimeMs: number;
}

// ERP types
export type ERPSystemType = 'SAP' | 'ORACLE' | 'WORKDAY';

export interface ERPSyncConfig {
  readonly erpSystem: ERPSystemType;
  readonly connectionUrl: string;
  readonly syncEnabled: boolean;
  readonly syncIntervalMinutes: number;
  readonly lastSyncAt?: ISODateString;
}

export interface ERPPurchaseOrder {
  readonly erpPoNumber: string;
  readonly erpSystem: ERPSystemType;
  readonly vendorId: string;
  readonly totalAmount: number;
  readonly currency: string;
  readonly status: string;
  readonly orderDate: ISODateString;
}

// Vendor types
export type IntegrationVendorType = 'CDW' | 'INSIGHT' | 'SHI' | 'DELL_DIRECT' | 'HP_DIRECT' | 'OTHER';

export interface VendorCatalogItem {
  readonly catalogItemId: UUID;
  readonly vendorType: IntegrationVendorType;
  readonly vendorSku: string;
  readonly productName: string;
  readonly description?: string;
  readonly category: string;
  readonly unitPrice: number;
  readonly currency: string;
  readonly inStock: boolean;
}

export interface VendorCatalog {
  readonly vendorType: IntegrationVendorType;
  readonly vendorName: string;
  readonly catalogDate: ISODateString;
  readonly totalItems: number;
  readonly items: readonly VendorCatalogItem[];
  readonly categories: readonly string[];
}
