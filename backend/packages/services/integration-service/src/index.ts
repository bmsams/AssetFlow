/**
 * @ams/integration-service - Integration Service
 *
 * Provides integration operations including:
 * - Discovery Integration Service (Requirement 7.1, 7.2)
 *   - Ingest asset data from SCCM, Jamf, Tanium, and custom discovery sources
 *   - Match discovery records to existing assets by serial_number and mac_address
 *   - Create new assets for unmatched discovery records
 * - ERP Integration Service (Requirement 7.3, 7.4)
 *   - Synchronize purchase orders, cost centers, and financial data
 *   - Support SAP, Oracle, and Workday connectors
 * - Vendor Integration Service (Requirement 7.5, 7.6)
 *   - Receive Advance Ship Notices from CDW, Insight
 *   - Pre-create asset records with serial numbers
 * - Retry and Error Handling (Requirement 7.7, 7.8, 7.9)
 *   - Retry logic with exponential backoff
 *   - Circuit breaker pattern for failing integrations
 *   - Incident creation after max retries
 */

// Export discovery module
export * from './discovery';

// Export ERP module
export * from './erp';

// Export retry module
export * from './retry';

// Export vendor module (with explicit exports to avoid conflicts)
export {
  // Types
  VendorType,
  ASNStatus,
  ASNLineStatus,
  CatalogItemAvailability,
  AdvanceShipNotice,
  ASNLineItem,
  VendorAddress,
  CDWASNPayload,
  CDWASNItem,
  InsightASNPayload,
  InsightASNItem,
  ASNProcessingResult,
  ASNLineResult,
  ASNProcessingError,
  VendorCatalogItem,
  VendorCatalog,
  VendorCatalogSearchRequest,
  VendorCatalogSearchResult,
  VendorIntegrationConfig,
  PreCreatedAsset,
  // Repository functions
  createASN,
  createASNLine,
  getASNById,
  findASNByVendorNumber,
  updateASNStatus,
  updateASNLineStatus,
  getPendingASNs,
  preCreateAssetFromASN,
  linkPurchaseOrderToASN,
  findPurchaseOrderByNumber,
  getVendorCatalogItems,
  getVendorCatalogCategories,
  upsertVendorCatalogItem,
  getVendorConfig,
  updateVendorLastSync,
  // Service functions
  processCDWASN,
  processInsightASN,
  processASN,
  getASN,
  getASNsByVendor,
  getASNStatistics,
  getVendorCatalog,
  searchVendorCatalog,
  getPreCreatedAssets,
} from './vendor';

// Re-export findAssetBySerialNumber from vendor with a different name to avoid conflict
export { findAssetBySerialNumber as findAssetBySerialNumberForVendor } from './vendor';
