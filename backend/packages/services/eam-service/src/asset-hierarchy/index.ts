/**
 * Asset Hierarchy Module
 *
 * Provides parent-child relationship management for enterprise assets.
 * Supports complex equipment with sub-components and status propagation.
 *
 * Requirements:
 * - 5.6: Support parent-child relationships for complex equipment with sub-components
 * - 5.7: Propagate relevant status updates to child components
 */

// Export service functions (primary API)
export {
  linkParentChild,
  unlinkParentChild,
  getParentAsset,
  getChildAssets,
  getAncestors,
  getDescendants,
  getRootAsset,
  getHierarchyDepth,
  hasParent,
  hasChildren,
  getChildCount,
  getDescendantCount,
  wouldCreateCircularReference,
  shouldPropagateStatus,
  propagateStatus,
  getHierarchy,
  getEnterpriseAsset,
} from './asset-hierarchy-service';

// Export types from repository
export type {
  AssetStatus,
  HierarchyNode,
  EnterpriseAssetHierarchy,
  LinkParentChildRequest,
  StatusPropagationResult,
} from './asset-hierarchy-repository';

export { MAX_HIERARCHY_DEPTH } from './asset-hierarchy-repository';
