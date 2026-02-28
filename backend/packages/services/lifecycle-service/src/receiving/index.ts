/**
 * Receiving module exports
 *
 * Provides receiving operations including:
 * - Recording receiving of assets (Requirement 6.4, 6.5)
 * - Barcode scanning for asset creation (Requirement 6.4)
 * - Linking assets to purchase orders (Requirement 6.5)
 * - Updating asset status to In_Stock (Requirement 6.5)
 * - Quality inspection workflow (Requirement 13)
 */

// Export types from repository
export type {
  ReceivingStatus,
  ReceivingCondition,
  AssetStatus,
  ReceivingRecord,
  ReceivingLine,
  ScannedAsset,
  CreateReceivingRecordInput,
  CreateReceivingLineInput,
  RecordAssetScanInput,
  InspectionStatus,
  InspectionResult,
  InspectionRecord,
  CreateInspectionRecordInput,
  RecordInspectionResultInput as RepositoryRecordInspectionResultInput,
  InspectionHistoryFilter,
} from './receiving-repository';

// Export repository functions (low-level data access)
export {
  createReceivingRecord,
  getReceivingRecordById,
  createReceivingLineFromPO,
  createReceivingLine,
  getReceivingLines,
  getReceivingLineById,
  recordAssetScan,
  updateReceivingRecordStatus,
  getReceivingRecords,
  // Inspection repository functions
  createInspectionRecord,
  getInspectionRecordById,
  getInspectionRecordsByReceivingLine,
  getInspectionRecordsByReceiving,
  getInspectionHistoryByAsset,
  getInspectionRecords as getInspectionRecordsRepo,
  updateInspectionStatus,
  recordInspectionResult as recordInspectionResultRepo,
  routeInspectionToReturn as routeInspectionToReturnRepo,
  getPendingInspectionsCount as getPendingInspectionsCountRepo,
  getFailedInspections as getFailedInspectionsRepo,
} from './receiving-repository';

// Export service functions (business logic) - these wrap repository functions
export {
  recordReceivingFromPO,
  recordReceivingManual,
  scanAsset,
  getReceivingRecord,
  getReceivingRecordsByPO,
  getAssetsFromReceiving,
  cancelReceiving,
  completeReceiving,
  // Inspection service functions
  markForInspection,
  recordInspectionResult,
  getInspectionRecord,
  getInspectionsByReceivingLine,
  getInspectionsByReceiving,
  getInspectionHistoryByAsset as getAssetInspectionHistory,
  getInspectionRecords,
  getPendingInspectionsCount,
  getFailedInspections,
  routeInspectionToReturn,
} from './receiving-service';

// Export service types
export type {
  RecordReceivingResult,
  ScanAssetResult,
  RecordReceivingFromPOInput,
  RecordReceivingManualInput,
  ScanAssetInput,
  MarkForInspectionInput,
  MarkForInspectionResult,
  RecordInspectionResultInput,
  RecordInspectionResultResult,
} from './receiving-service';
