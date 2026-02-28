/**
 * Vendor Integration Types
 *
 * Type definitions for vendor integration including Advance Ship Notices (ASN)
 * and vendor catalog operations. Supports resellers like CDW and Insight.
 *
 * Requirements:
 * - 7.5: Receive Advance Ship Notices from resellers like CDW and Insight
 * - 7.6: Pre-create asset records with serial numbers before physical arrival
 */

import type { ISODateString, UUID } from '@ams/types';

/**
 * Supported vendor types
 */
export type VendorType = 'CDW' | 'INSIGHT' | 'SHI' | 'DELL_DIRECT' | 'HP_DIRECT' | 'OTHER';

/**
 * ASN processing status
 */
export type ASNStatus =
  | 'PENDING'      // Awaiting processing
  | 'PROCESSING'   // Currently being processed
  | 'COMPLETED'    // Successfully processed
  | 'PARTIAL'      // Partially processed (some items failed)
  | 'FAILED';      // Processing failed

/**
 * ASN line item status
 */
export type ASNLineStatus =
  | 'PENDING'      // Awaiting processing
  | 'ASSET_CREATED' // Asset pre-created successfully
  | 'ASSET_LINKED'  // Linked to existing asset
  | 'FAILED'       // Failed to process
  | 'SKIPPED';     // Skipped (e.g., duplicate)

/**
 * Vendor catalog item availability status
 */
export type CatalogItemAvailability = 'IN_STOCK' | 'LIMITED' | 'BACKORDERED' | 'DISCONTINUED';

// ============================================================================
// Advance Ship Notice (ASN) Types
// ============================================================================

/**
 * Advance Ship Notice from vendor
 * Contains shipment information with serial numbers before physical arrival
 */
export interface AdvanceShipNotice {
  readonly asnId: UUID;
  readonly vendorType: VendorType;
  readonly vendorName: string;
  readonly vendorAsnNumber: string;
  readonly purchaseOrderNumber: string;
  readonly purchaseOrderId?: UUID;
  readonly shipDate: ISODateString;
  readonly expectedDeliveryDate: ISODateString;
  readonly carrierName?: string;
  readonly trackingNumber?: string;
  readonly shipFromAddress?: VendorAddress;
  readonly shipToAddress?: VendorAddress;
  readonly status: ASNStatus;
  readonly totalItems: number;
  readonly processedItems: number;
  readonly failedItems: number;
  readonly lines: readonly ASNLineItem[];
  readonly rawData?: Record<string, unknown>;
  readonly processedAt?: ISODateString;
  readonly errorMessage?: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * ASN line item - individual item in a shipment
 */
export interface ASNLineItem {
  readonly lineId: UUID;
  readonly asnId: UUID;
  readonly lineNumber: number;
  readonly vendorPartNumber: string;
  readonly manufacturerPartNumber?: string;
  readonly description: string;
  readonly quantity: number;
  readonly serialNumbers: readonly string[];
  readonly manufacturer?: string;
  readonly model?: string;
  readonly unitPrice?: number;
  readonly status: ASNLineStatus;
  readonly createdAssetIds: readonly UUID[];
  readonly linkedAssetIds: readonly UUID[];
  readonly errorMessage?: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Vendor address
 */
export interface VendorAddress {
  readonly addressLine1: string;
  readonly addressLine2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
}

// ============================================================================
// ASN Processing Types
// ============================================================================

/**
 * ASN payload from CDW
 */
export interface CDWASNPayload {
  readonly asnNumber: string;
  readonly poNumber: string;
  readonly shipDate: ISODateString;
  readonly estimatedDeliveryDate: ISODateString;
  readonly carrier?: string;
  readonly trackingNumber?: string;
  readonly shipFrom?: {
    readonly address1: string;
    readonly address2?: string;
    readonly city: string;
    readonly state: string;
    readonly zip: string;
    readonly country: string;
  };
  readonly shipTo?: {
    readonly address1: string;
    readonly address2?: string;
    readonly city: string;
    readonly state: string;
    readonly zip: string;
    readonly country: string;
  };
  readonly items: readonly CDWASNItem[];
}

/**
 * CDW ASN item
 */
export interface CDWASNItem {
  readonly lineNumber: number;
  readonly cdwPartNumber: string;
  readonly mfrPartNumber?: string;
  readonly description: string;
  readonly quantity: number;
  readonly serialNumbers?: readonly string[];
  readonly manufacturer?: string;
  readonly unitPrice?: number;
}

/**
 * ASN payload from Insight
 */
export interface InsightASNPayload {
  readonly shipmentId: string;
  readonly purchaseOrderNumber: string;
  readonly shipmentDate: ISODateString;
  readonly expectedArrival: ISODateString;
  readonly carrierCode?: string;
  readonly trackingId?: string;
  readonly originAddress?: {
    readonly line1: string;
    readonly line2?: string;
    readonly city: string;
    readonly stateProvince: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
  readonly destinationAddress?: {
    readonly line1: string;
    readonly line2?: string;
    readonly city: string;
    readonly stateProvince: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
  readonly lineItems: readonly InsightASNItem[];
}

/**
 * Insight ASN item
 */
export interface InsightASNItem {
  readonly lineNum: number;
  readonly insightPartNumber: string;
  readonly manufacturerPartNumber?: string;
  readonly itemDescription: string;
  readonly qty: number;
  readonly serialNums?: readonly string[];
  readonly mfr?: string;
  readonly model?: string;
  readonly price?: number;
}

/**
 * ASN processing result
 */
export interface ASNProcessingResult {
  readonly asnId: UUID;
  readonly vendorType: VendorType;
  readonly vendorAsnNumber: string;
  readonly purchaseOrderNumber: string;
  readonly status: ASNStatus;
  readonly totalItems: number;
  readonly assetsCreated: number;
  readonly assetsLinked: number;
  readonly itemsFailed: number;
  readonly itemsSkipped: number;
  readonly lineResults: readonly ASNLineResult[];
  readonly errors: readonly ASNProcessingError[];
  readonly processingTimeMs: number;
}

/**
 * ASN line processing result
 */
export interface ASNLineResult {
  readonly lineNumber: number;
  readonly vendorPartNumber: string;
  readonly status: ASNLineStatus;
  readonly serialNumbers: readonly string[];
  readonly createdAssetIds: readonly UUID[];
  readonly linkedAssetIds: readonly UUID[];
  readonly errorMessage?: string;
}

/**
 * ASN processing error
 */
export interface ASNProcessingError {
  readonly lineNumber?: number;
  readonly serialNumber?: string;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly timestamp: ISODateString;
  readonly retryable: boolean;
}

// ============================================================================
// Vendor Catalog Types
// ============================================================================

/**
 * Vendor catalog item
 */
export interface VendorCatalogItem {
  readonly catalogItemId: UUID;
  readonly vendorType: VendorType;
  readonly vendorPartNumber: string;
  readonly manufacturerPartNumber?: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly description: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly unitPrice: number;
  readonly currency: string;
  readonly availability: CatalogItemAvailability;
  readonly leadTimeDays?: number;
  readonly minimumOrderQuantity?: number;
  readonly specifications?: Record<string, string>;
  readonly imageUrl?: string;
  readonly productUrl?: string;
  readonly lastUpdatedAt: ISODateString;
  readonly createdAt: ISODateString;
}

/**
 * Vendor catalog
 */
export interface VendorCatalog {
  readonly vendorType: VendorType;
  readonly vendorName: string;
  readonly catalogDate: ISODateString;
  readonly totalItems: number;
  readonly items: readonly VendorCatalogItem[];
  readonly categories: readonly string[];
}

/**
 * Vendor catalog search request
 */
export interface VendorCatalogSearchRequest {
  readonly vendorType?: VendorType;
  readonly searchTerm?: string;
  readonly category?: string;
  readonly manufacturer?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly availability?: CatalogItemAvailability;
  readonly page?: number;
  readonly limit?: number;
}

/**
 * Vendor catalog search result
 */
export interface VendorCatalogSearchResult {
  readonly items: readonly VendorCatalogItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

// ============================================================================
// Vendor Configuration Types
// ============================================================================

/**
 * Vendor integration configuration
 */
export interface VendorIntegrationConfig {
  readonly configId: UUID;
  readonly vendorType: VendorType;
  readonly vendorName: string;
  readonly isActive: boolean;
  readonly autoProcessASN: boolean;
  readonly autoCreateAssets: boolean;
  readonly defaultStockroomId?: UUID;
  readonly webhookUrl?: string;
  readonly apiEndpoint?: string;
  readonly lastSyncAt?: ISODateString;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Pre-created asset from ASN
 */
export interface PreCreatedAsset {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly serialNumber: string;
  readonly asnId: UUID;
  readonly asnLineId: UUID;
  readonly purchaseOrderId?: UUID;
  readonly vendorType: VendorType;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly description: string;
  readonly expectedDeliveryDate: ISODateString;
  readonly status: 'ORDERED' | 'IN_TRANSIT';
  readonly createdAt: ISODateString;
}

