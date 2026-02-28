/**
 * Vendor Integration Module
 *
 * Handles integration with vendors (CDW, Insight) for:
 * - Advance Ship Notice (ASN) processing
 * - Pre-creating assets with serial numbers before physical arrival
 * - Vendor catalog management
 *
 * Requirements:
 * - 7.5: Receive Advance Ship Notices from resellers like CDW and Insight
 * - 7.6: Pre-create asset records with serial numbers before physical arrival
 */

export * from './vendor-types';
export {
  // ASN Operations
  createASN,
  createASNLine,
  getASNById,
  findASNByVendorNumber,
  updateASNStatus,
  updateASNLineStatus,
  getPendingASNs,
  // Pre-Created Asset Operations
  preCreateAssetFromASN,
  findAssetBySerialNumber,
  linkPurchaseOrderToASN,
  findPurchaseOrderByNumber,
  // Vendor Catalog Operations
  getVendorCatalogItems,
  getVendorCatalogCategories,
  upsertVendorCatalogItem,
  // Vendor Configuration Operations
  getVendorConfig,
  updateVendorLastSync,
} from './vendor-repository';
export {
  // ASN Processing
  processCDWASN,
  processInsightASN,
  processASN,
  getASN,
  getASNsByVendor,
  getASNStatistics,
  // Vendor Catalog
  getVendorCatalog,
  searchVendorCatalog,
  getPreCreatedAssets,
} from './vendor-service';

