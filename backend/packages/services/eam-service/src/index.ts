/**
 * @ams/eam-service - Enterprise Asset Management Service
 *
 * Provides enterprise asset management operations including:
 * - Maintenance Plan Service for scheduling preventative maintenance (Requirement 5.1, 5.2)
 * - Work Order Service for maintenance task management (Requirement 2C.7)
 * - Linear Asset Service for segment-based tracking (Requirement 5.3)
 * - Parts Inventory Service for spare parts management (Requirement 5.4, 5.5)
 * - Asset Hierarchy Service for parent-child relationships (Requirement 5.6, 5.7)
 */

// Export linear asset module
export * from './linear-asset';

// Export asset hierarchy module
export * from './asset-hierarchy';

// Export enhanced work order module (Requirement 14) - primary work order exports
// This module takes precedence over maintenance and parts-inventory for work order types
export * from './work-order';

// Export maintenance module - import as namespace to avoid conflicts
import * as maintenanceModule from './maintenance';
export { maintenanceModule };

// Export parts inventory module - import as namespace to avoid conflicts
import * as partsInventoryModule from './parts-inventory';
export { partsInventoryModule };

// Export work order handlers
export { handler as createWorkOrderHandler } from './handlers/create-work-order';
export { handler as assignWorkOrderHandler } from './handlers/assign-work-order';
export { handler as completeWorkOrderHandler } from './handlers/complete-work-order';
export { handler as getWorkOrderHandler } from './handlers/get-work-order';
export { handler as listWorkOrdersHandler } from './handlers/list-work-orders';

// Export linear asset handlers
export { handler as createLinearAssetHandler } from './handlers/create-linear-asset';
export { handler as getLinearAssetHandler, handlerByAssetId as getLinearAssetByAssetIdHandler } from './handlers/get-linear-asset';
export { handler as updateSegmentHandler } from './handlers/update-segment';
export { handler as listSegmentsHandler, handlerConditionSummary as getSegmentConditionSummaryHandler } from './handlers/list-segments';

// Export parts inventory handlers
export { handler as reservePartsHandler } from './handlers/reserve-parts';
export { handler as consumePartsHandler } from './handlers/consume-parts';
export { handler as checkPartLevelsHandler, scheduledHandler as checkPartLevelsScheduledHandler } from './handlers/check-part-levels';

// Export asset hierarchy handlers
export { handler as linkParentChildHandler } from './handlers/link-parent-child';
export { handler as unlinkParentChildHandler } from './handlers/unlink-parent-child';
export { handler as getHierarchyHandler, handlerChildren as getChildrenHandler, handlerParent as getParentHandler } from './handlers/get-hierarchy';
export { handler as propagateStatusHandler, handlerCheckPropagation as checkPropagationHandler } from './handlers/propagate-status';

// Export enhanced work order handlers (Requirement 14)
export {
  getWorkOrderWithParts as getWorkOrderWithPartsHandler,
  listWorkOrdersHandler as listWorkOrdersEnhancedHandler,
  updateWorkOrderStatusHandler,
  getWorkOrderPartsHandler,
  addPartToWorkOrderHandler,
  recordPartUsageHandler,
  removePartFromWorkOrderHandler,
} from './handlers/work-order-handlers';
