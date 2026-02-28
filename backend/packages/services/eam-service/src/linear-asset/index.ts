/**
 * Linear Asset Module
 *
 * Provides linear asset management operations including:
 * - Linear asset CRUD operations (Requirement 5.3)
 * - Segment-based location tracking
 * - Total length calculation from segments
 * - Segment condition monitoring
 */

// Export service functions
export {
  // Linear asset operations
  getLinearAsset,
  getLinearAssetByAssetId,
  getLinearAssetWithSegments,
  getLinearAssets,
  getLinearAssetsByRouteType,
  createLinearAsset,
  updateLinearAsset,
  deleteLinearAsset,
  // Segment operations
  getSegment,
  getSegmentsByLinearAssetId,
  getSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  // Analysis and reporting
  calculateTotalLength,
  getSegmentConditionSummary,
  getSegmentsByCondition,
  getSegmentsWithDefects,
  getSegmentsDueForInspection,
} from './linear-asset-service';

// Export types
export type {
  ConditionRating,
  CreateLinearAssetRequest,
  CreateSegmentRequest,
  LinearAsset,
  LinearAssetSegment,
  LinearUnit,
  RouteType,
  UpdateLinearAssetRequest,
  UpdateSegmentRequest,
  LinearAssetWithSegments,
  SegmentConditionSummary,
} from './linear-asset-service';
