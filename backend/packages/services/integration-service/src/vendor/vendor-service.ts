/**
 * Vendor Integration Service - Business logic layer
 *
 * Implements:
 * - Process Advance Ship Notices from CDW, Insight (Requirement 7.5)
 * - Pre-create asset records with serial numbers (Requirement 7.6)
 * - Vendor catalog management
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES } from '@ams/cache';
import { createLogger } from '@ams/utils';

import type {
  AdvanceShipNotice,
  ASNLineResult,
  ASNLineStatus,
  ASNProcessingError,
  ASNProcessingResult,
  ASNStatus,
  CDWASNPayload,
  InsightASNPayload,
  PreCreatedAsset,
  VendorAddress,
  VendorCatalog,
  VendorCatalogSearchRequest,
  VendorCatalogSearchResult,
  VendorType,
} from './vendor-types';
import * as repository from './vendor-repository';

const logger = createLogger({ service: 'vendor-service' });

// ============================================================================
// ASN Processing - CDW
// ============================================================================

/**
 * Convert CDW address to VendorAddress
 */
function convertCDWAddress(
  addr?: { address1: string; address2?: string; city: string; state: string; zip: string; country: string }
): VendorAddress | undefined {
  if (!addr) return undefined;
  return {
    addressLine1: addr.address1,
    addressLine2: addr.address2,
    city: addr.city,
    state: addr.state,
    postalCode: addr.zip,
    country: addr.country,
  };
}

/**
 * Process ASN from CDW
 * Requirement 7.5: Receive Advance Ship Notices from CDW
 */
export async function processCDWASN(payload: CDWASNPayload): Promise<ASNProcessingResult> {
  const startTime = Date.now();
  const vendorType: VendorType = 'CDW';

  logger.info('Processing CDW ASN', {
    asnNumber: payload.asnNumber,
    poNumber: payload.poNumber,
    itemCount: payload.items.length,
  });

  // Check if ASN already exists
  const existingASN = await repository.findASNByVendorNumber(vendorType, payload.asnNumber);
  if (existingASN) {
    logger.info('ASN already processed', { asnNumber: payload.asnNumber, status: existingASN.status });
    return {
      asnId: existingASN.asnId,
      vendorType,
      vendorAsnNumber: payload.asnNumber,
      purchaseOrderNumber: payload.poNumber,
      status: existingASN.status,
      totalItems: existingASN.totalItems,
      assetsCreated: existingASN.processedItems,
      assetsLinked: 0,
      itemsFailed: existingASN.failedItems,
      itemsSkipped: 0,
      lineResults: [],
      errors: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Find linked purchase order
  const purchaseOrder = await repository.findPurchaseOrderByNumber(payload.poNumber);

  // Calculate total items (sum of quantities with serial numbers)
  const totalItems = payload.items.reduce((sum, item) => sum + (item.serialNumbers?.length ?? 0), 0);

  // Create ASN record
  const asn = await repository.createASN({
    vendorType,
    vendorName: 'CDW',
    vendorAsnNumber: payload.asnNumber,
    purchaseOrderNumber: payload.poNumber,
    purchaseOrderId: purchaseOrder?.poId,
    shipDate: payload.shipDate,
    expectedDeliveryDate: payload.estimatedDeliveryDate,
    carrierName: payload.carrier,
    trackingNumber: payload.trackingNumber,
    shipFromAddress: convertCDWAddress(payload.shipFrom),
    shipToAddress: convertCDWAddress(payload.shipTo),
    status: 'PROCESSING',
    totalItems,
    processedItems: 0,
    failedItems: 0,
    rawData: payload as unknown as Record<string, unknown>,
  });

  // Process each line item
  const lineResults: ASNLineResult[] = [];
  const errors: ASNProcessingError[] = [];
  let assetsCreated = 0;
  let assetsLinked = 0;
  let itemsFailed = 0;
  let itemsSkipped = 0;

  for (const item of payload.items) {
    const result = await processASNLineItem(
      asn.asnId,
      item.lineNumber,
      item.cdwPartNumber,
      item.mfrPartNumber,
      item.description,
      item.serialNumbers ?? [],
      item.manufacturer,
      undefined, // model not provided by CDW
      item.unitPrice,
      vendorType,
      purchaseOrder?.poId,
      payload.estimatedDeliveryDate
    );

    lineResults.push(result.lineResult);
    errors.push(...result.errors);
    assetsCreated += result.assetsCreated;
    assetsLinked += result.assetsLinked;
    itemsFailed += result.itemsFailed;
    itemsSkipped += result.itemsSkipped;
  }

  // Determine final status
  const finalStatus: ASNStatus = 
    itemsFailed === totalItems ? 'FAILED' :
    itemsFailed > 0 ? 'PARTIAL' : 'COMPLETED';

  // Update ASN status
  await repository.updateASNStatus(
    asn.asnId,
    finalStatus,
    assetsCreated + assetsLinked,
    itemsFailed
  );

  const processingTimeMs = Date.now() - startTime;

  logger.info('CDW ASN processing completed', {
    asnId: asn.asnId,
    asnNumber: payload.asnNumber,
    status: finalStatus,
    assetsCreated,
    assetsLinked,
    itemsFailed,
    processingTimeMs,
  });

  return {
    asnId: asn.asnId,
    vendorType,
    vendorAsnNumber: payload.asnNumber,
    purchaseOrderNumber: payload.poNumber,
    status: finalStatus,
    totalItems,
    assetsCreated,
    assetsLinked,
    itemsFailed,
    itemsSkipped,
    lineResults,
    errors,
    processingTimeMs,
  };
}

// ============================================================================
// ASN Processing - Insight
// ============================================================================

/**
 * Convert Insight address to VendorAddress
 */
function convertInsightAddress(
  addr?: { line1: string; line2?: string; city: string; stateProvince: string; postalCode: string; countryCode: string }
): VendorAddress | undefined {
  if (!addr) return undefined;
  return {
    addressLine1: addr.line1,
    addressLine2: addr.line2,
    city: addr.city,
    state: addr.stateProvince,
    postalCode: addr.postalCode,
    country: addr.countryCode,
  };
}

/**
 * Process ASN from Insight
 * Requirement 7.5: Receive Advance Ship Notices from Insight
 */
export async function processInsightASN(payload: InsightASNPayload): Promise<ASNProcessingResult> {
  const startTime = Date.now();
  const vendorType: VendorType = 'INSIGHT';

  logger.info('Processing Insight ASN', {
    shipmentId: payload.shipmentId,
    poNumber: payload.purchaseOrderNumber,
    itemCount: payload.lineItems.length,
  });

  // Check if ASN already exists
  const existingASN = await repository.findASNByVendorNumber(vendorType, payload.shipmentId);
  if (existingASN) {
    logger.info('ASN already processed', { shipmentId: payload.shipmentId, status: existingASN.status });
    return {
      asnId: existingASN.asnId,
      vendorType,
      vendorAsnNumber: payload.shipmentId,
      purchaseOrderNumber: payload.purchaseOrderNumber,
      status: existingASN.status,
      totalItems: existingASN.totalItems,
      assetsCreated: existingASN.processedItems,
      assetsLinked: 0,
      itemsFailed: existingASN.failedItems,
      itemsSkipped: 0,
      lineResults: [],
      errors: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Find linked purchase order
  const purchaseOrder = await repository.findPurchaseOrderByNumber(payload.purchaseOrderNumber);

  // Calculate total items (sum of quantities with serial numbers)
  const totalItems = payload.lineItems.reduce((sum, item) => sum + (item.serialNums?.length ?? 0), 0);

  // Create ASN record
  const asn = await repository.createASN({
    vendorType,
    vendorName: 'Insight',
    vendorAsnNumber: payload.shipmentId,
    purchaseOrderNumber: payload.purchaseOrderNumber,
    purchaseOrderId: purchaseOrder?.poId,
    shipDate: payload.shipmentDate,
    expectedDeliveryDate: payload.expectedArrival,
    carrierName: payload.carrierCode,
    trackingNumber: payload.trackingId,
    shipFromAddress: convertInsightAddress(payload.originAddress),
    shipToAddress: convertInsightAddress(payload.destinationAddress),
    status: 'PROCESSING',
    totalItems,
    processedItems: 0,
    failedItems: 0,
    rawData: payload as unknown as Record<string, unknown>,
  });

  // Process each line item
  const lineResults: ASNLineResult[] = [];
  const errors: ASNProcessingError[] = [];
  let assetsCreated = 0;
  let assetsLinked = 0;
  let itemsFailed = 0;
  let itemsSkipped = 0;

  for (const item of payload.lineItems) {
    const result = await processASNLineItem(
      asn.asnId,
      item.lineNum,
      item.insightPartNumber,
      item.manufacturerPartNumber,
      item.itemDescription,
      item.serialNums ?? [],
      item.mfr,
      item.model,
      item.price,
      vendorType,
      purchaseOrder?.poId,
      payload.expectedArrival
    );

    lineResults.push(result.lineResult);
    errors.push(...result.errors);
    assetsCreated += result.assetsCreated;
    assetsLinked += result.assetsLinked;
    itemsFailed += result.itemsFailed;
    itemsSkipped += result.itemsSkipped;
  }

  // Determine final status
  const finalStatus: ASNStatus = 
    itemsFailed === totalItems ? 'FAILED' :
    itemsFailed > 0 ? 'PARTIAL' : 'COMPLETED';

  // Update ASN status
  await repository.updateASNStatus(
    asn.asnId,
    finalStatus,
    assetsCreated + assetsLinked,
    itemsFailed
  );

  const processingTimeMs = Date.now() - startTime;

  logger.info('Insight ASN processing completed', {
    asnId: asn.asnId,
    shipmentId: payload.shipmentId,
    status: finalStatus,
    assetsCreated,
    assetsLinked,
    itemsFailed,
    processingTimeMs,
  });

  return {
    asnId: asn.asnId,
    vendorType,
    vendorAsnNumber: payload.shipmentId,
    purchaseOrderNumber: payload.purchaseOrderNumber,
    status: finalStatus,
    totalItems,
    assetsCreated,
    assetsLinked,
    itemsFailed,
    itemsSkipped,
    lineResults,
    errors,
    processingTimeMs,
  };
}

// ============================================================================
// Common ASN Line Processing
// ============================================================================

/**
 * Process a single ASN line item
 * Requirement 7.6: Pre-create asset records with serial numbers
 */
async function processASNLineItem(
  asnId: UUID,
  lineNumber: number,
  vendorPartNumber: string,
  manufacturerPartNumber: string | undefined,
  description: string,
  serialNumbers: readonly string[],
  manufacturer: string | undefined,
  model: string | undefined,
  unitPrice: number | undefined,
  vendorType: VendorType,
  purchaseOrderId: UUID | undefined,
  expectedDeliveryDate: string
): Promise<{
  lineResult: ASNLineResult;
  errors: ASNProcessingError[];
  assetsCreated: number;
  assetsLinked: number;
  itemsFailed: number;
  itemsSkipped: number;
}> {
  const errors: ASNProcessingError[] = [];
  const createdAssetIds: UUID[] = [];
  const linkedAssetIds: UUID[] = [];
  let itemsFailed = 0;
  let itemsSkipped = 0;

  // Create ASN line record
  const asnLine = await repository.createASNLine({
    asnId,
    lineNumber,
    vendorPartNumber,
    manufacturerPartNumber,
    description,
    quantity: serialNumbers.length || 1,
    serialNumbers,
    manufacturer,
    model,
    unitPrice,
    status: 'PENDING',
    createdAssetIds: [],
    linkedAssetIds: [],
  });

  // Process each serial number
  for (const serialNumber of serialNumbers) {
    try {
      // Check if asset already exists with this serial number
      const existingAsset = await repository.findAssetBySerialNumber(serialNumber);

      if (existingAsset) {
        // Asset already exists - link it
        linkedAssetIds.push(existingAsset.assetId);
        logger.info('Asset already exists for serial number', {
          serialNumber,
          assetId: existingAsset.assetId,
        });
      } else {
        // Pre-create new asset
        const preCreatedAsset = await repository.preCreateAssetFromASN(
          serialNumber,
          asnId,
          asnLine.lineId,
          purchaseOrderId,
          vendorType,
          manufacturer,
          model,
          description,
          expectedDeliveryDate
        );
        createdAssetIds.push(preCreatedAsset.assetId);
      }
    } catch (error) {
      const err = error as Error;
      itemsFailed++;
      errors.push({
        lineNumber,
        serialNumber,
        errorCode: 'ASSET_CREATION_FAILED',
        errorMessage: err.message,
        timestamp: new Date().toISOString(),
        retryable: true,
      });
      logger.error('Failed to process serial number', err, {
        lineNumber,
        serialNumber,
        vendorPartNumber,
      });
    }
  }

  // If no serial numbers provided, skip the line
  if (serialNumbers.length === 0) {
    itemsSkipped = 1;
    await repository.updateASNLineStatus(
      asnLine.lineId,
      'SKIPPED',
      [],
      [],
      'No serial numbers provided'
    );

    return {
      lineResult: {
        lineNumber,
        vendorPartNumber,
        status: 'SKIPPED',
        serialNumbers,
        createdAssetIds: [],
        linkedAssetIds: [],
        errorMessage: 'No serial numbers provided',
      },
      errors,
      assetsCreated: 0,
      assetsLinked: 0,
      itemsFailed: 0,
      itemsSkipped,
    };
  }

  // Determine line status
  let lineStatus: ASNLineStatus;
  if (itemsFailed === serialNumbers.length) {
    lineStatus = 'FAILED';
  } else if (createdAssetIds.length > 0 && linkedAssetIds.length === 0) {
    lineStatus = 'ASSET_CREATED';
  } else if (linkedAssetIds.length > 0 && createdAssetIds.length === 0) {
    lineStatus = 'ASSET_LINKED';
  } else if (createdAssetIds.length > 0 || linkedAssetIds.length > 0) {
    lineStatus = 'ASSET_CREATED'; // Mixed - prefer created status
  } else {
    lineStatus = 'FAILED';
  }

  // Update line status
  await repository.updateASNLineStatus(
    asnLine.lineId,
    lineStatus,
    createdAssetIds,
    linkedAssetIds,
    itemsFailed > 0 ? `${itemsFailed} items failed` : undefined
  );

  return {
    lineResult: {
      lineNumber,
      vendorPartNumber,
      status: lineStatus,
      serialNumbers,
      createdAssetIds,
      linkedAssetIds,
      errorMessage: itemsFailed > 0 ? `${itemsFailed} items failed` : undefined,
    },
    errors,
    assetsCreated: createdAssetIds.length,
    assetsLinked: linkedAssetIds.length,
    itemsFailed,
    itemsSkipped,
  };
}

// ============================================================================
// Generic ASN Processing
// ============================================================================

/**
 * Process ASN based on vendor type
 */
export async function processASN(
  vendorType: VendorType,
  payload: CDWASNPayload | InsightASNPayload
): Promise<ASNProcessingResult> {
  switch (vendorType) {
    case 'CDW':
      return processCDWASN(payload as CDWASNPayload);
    case 'INSIGHT':
      return processInsightASN(payload as InsightASNPayload);
    default:
      throw new Error(`Unsupported vendor type: ${vendorType}`);
  }
}

/**
 * Get ASN by ID
 */
export async function getASN(asnId: UUID): Promise<AdvanceShipNotice | null> {
  return repository.getASNById(asnId);
}

/**
 * Get ASNs by vendor
 */
export async function getASNsByVendor(
  vendorType: VendorType,
  limit = 100
): Promise<AdvanceShipNotice[]> {
  return repository.getASNsByVendor(vendorType, limit);
}

/**
 * Get ASN statistics
 */
export async function getASNStatistics(vendorType?: VendorType) {
  return repository.getASNStatistics(vendorType);
}

// ============================================================================
// Vendor Catalog Operations
// ============================================================================

/**
 * Get vendor catalog
 */
export async function getVendorCatalog(
  vendorType: VendorType
): Promise<VendorCatalog> {
  logger.info('Getting vendor catalog', { vendorType });

  const cacheKey = `ams:${CACHE_ENTITY_TYPES.VENDOR_CATALOG}:${vendorType}`;
  const cached = await cache.get<VendorCatalog>(cacheKey);
  if (cached) {
    return cached;
  }

  const { items, totalCount } = await repository.getVendorCatalogItems({
    vendorType,
    limit: 1000,
  });

  const categories = await repository.getVendorCatalogCategories(vendorType);

  const vendorNames: Record<VendorType, string> = {
    CDW: 'CDW',
    INSIGHT: 'Insight',
    SHI: 'SHI International',
    DELL_DIRECT: 'Dell Direct',
    HP_DIRECT: 'HP Direct',
    OTHER: 'Other',
  };

  const catalog: VendorCatalog = {
    vendorType,
    vendorName: vendorNames[vendorType],
    catalogDate: new Date().toISOString(),
    totalItems: totalCount,
    items,
    categories,
  };

  await cache.set(cacheKey, catalog, { ttl: cache.DEFAULT_TTL.MEDIUM });
  return catalog;
}

/**
 * Search vendor catalog
 */
export async function searchVendorCatalog(
  request: VendorCatalogSearchRequest
): Promise<VendorCatalogSearchResult> {
  logger.info('Searching vendor catalog', {
    vendorType: request.vendorType,
    searchTerm: request.searchTerm,
    category: request.category,
  });

  const page = request.page ?? 1;
  const limit = Math.min(request.limit ?? 50, 100);

  const { items, totalCount } = await repository.getVendorCatalogItems(request);

  return {
    items,
    totalCount,
    page,
    limit,
    hasMore: page * limit < totalCount,
  };
}

/**
 * Get pre-created assets from ASN
 */
export async function getPreCreatedAssets(
  asnId: UUID
): Promise<PreCreatedAsset[]> {
  const asn = await repository.getASNById(asnId);
  if (!asn) {
    return [];
  }

  const preCreatedAssets: PreCreatedAsset[] = [];

  for (const line of asn.lines) {
    for (let i = 0; i < line.createdAssetIds.length; i++) {
      const assetId = line.createdAssetIds[i];
      const serialNumber = line.serialNumbers[i];
      
      if (assetId && serialNumber) {
        preCreatedAssets.push({
          assetId,
          assetTag: '', // Would need to fetch from assets table
          serialNumber,
          asnId: asn.asnId,
          asnLineId: line.lineId,
          purchaseOrderId: asn.purchaseOrderId,
          vendorType: asn.vendorType,
          manufacturer: line.manufacturer,
          model: line.model,
          description: line.description,
          expectedDeliveryDate: asn.expectedDeliveryDate,
          status: 'ORDERED',
          createdAt: line.createdAt,
        });
      }
    }
  }

  return preCreatedAssets;
}

