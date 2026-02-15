/**
 * Services module exports
 * Provides WebSocket and real-time update services
 * Implements Requirement 12.6: Real-time dashboard updates via WebSocket connections
 */

export {
  WebSocketService,
  getWebSocketService,
  resetWebSocketService,
  type WebSocketConfig,
  type WebSocketEventHandler,
  type ConnectionState,
  type ConnectionStateHandler,
} from './websocket-service';

export {
  type DashboardEvent,
  type DashboardEventType,
  type BaseEvent,
  type AssetCreatedEvent,
  type AssetUpdatedEvent,
  type AssetDeletedEvent,
  type AssetStateChangedEvent,
  type InventoryChangedEvent,
  type ComplianceChangedEvent,
  type LeaseExpirationEvent,
  type TransferOrderUpdatedEvent,
  type StockLevelAlertEvent,
  type ReclamationIdentifiedEvent,
  type ConnectionEstablishedEvent,
  type HeartbeatEvent,
  isDashboardEvent,
  isAssetEvent,
  isInventoryEvent,
  isComplianceEvent,
} from './websocket-events';

export {
  PushNotificationService,
  getPushNotificationService,
  resetPushNotificationService,
  isNotificationSupported,
  getNotificationPermission,
  type NotificationClickHandler,
  type NotificationReceivedHandler,
  type StateChangeHandler,
} from './push-notification-service';

export {
  apiClient,
  get,
  post,
  put,
  patch,
  del,
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
  isAuthenticated,
  ApiError,
} from './api-client';

export {
  assetApi,
  createAsset,
  getAsset,
  listAssets,
  updateAsset,
  deleteAsset,
  transitionAssetState,
  searchAssets,
  getAssetHistory,
} from './asset-api';


export {
  authService,
  login,
  logout,
  refreshAccessToken,
  getCurrentUser,
  isSessionValid,
  getValidAccessToken,
  type UserInfo,
  type LoginCredentials,
} from './auth-service';

export {
  reportApi,
  getAssetSummaryReport,
  getAssetAgingReport,
  getAssetsByLocationReport,
  getAssetsByDepartmentReport,
  getCostCenterUtilizationReport,
  getProcurementSpendingReport,
  getWorkOrderSummaryReport,
  getMaintenanceComplianceReport,
  exportReport,
  getFileExtension,
  downloadBlob,
} from './report-api';

export {
  dashboardApi,
  getDashboardSummary,
} from './dashboard-api';

export {
  catalogApi,
  getCatalogItems,
  searchCatalog,
} from './catalog-api';

export {
  contractsApi,
  getContracts,
  createContract,
  updateContract,
} from './contracts-api';

export {
  lifecycleApi,
  deployAsset,
  initiateRetirement,
  completeDisposal,
} from './lifecycle-api';

export {
  stockroomApi,
  getStockroomInventory,
  updateInventory,
} from './stockroom-api';

export {
  samApi,
  getCompliancePositions,
  getReclamationCandidates,
  getReconciliationSummary,
  getLicenseWorkbenchSummary,
} from './sam-api';

export {
  procurementApi,
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  addPOLine,
  updatePOLine,
  removePOLine,
  submitForApproval,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  sendToVendor,
  cancelPurchaseOrder,
  getVendorsForDropdown,
  getCostCentersForDropdown,
} from './procurement-api';

export {
  receivingApi,
  createReceivingFromPO,
  getReceivingRecord,
  scanAsset,
  completeReceiving,
  cancelReceiving,
  getInspection,
  markForInspection,
  recordInspectionResult,
} from './receiving-api';
