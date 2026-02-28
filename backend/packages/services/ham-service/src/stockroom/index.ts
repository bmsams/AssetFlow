/**
 * Stockroom Module - Exports for stockroom inventory management
 *
 * Implements:
 * - Stockroom CRUD operations (Requirement 5.1-5.7)
 * - Bin location CRUD operations (Requirement 6.1-6.5)
 * - Inventory tracking across multiple stockrooms (Requirement 3.2)
 * - Stock level monitoring and threshold alerts (Requirement 3.3)
 */

// Export service functions
export {
  // Stockroom CRUD operations
  createStockroom,
  deactivateStockroom,
  deleteStockroom,
  getActiveStockrooms,
  getStockroom,
  getStockroomByCode,
  getStockroomOrThrow,
  getStockroomsByLocation,
  isStockroomNameUnique,
  listStockrooms,
  reactivateStockroom,
  updateStockroom,
  // Inventory operations
  adjustInventoryQuantity,
  checkStockLevels,
  createInventoryItem,
  generateReplenishmentAlerts,
  getInventoryItem,
  getStockroomInventory,
  getStockroomSummary,
  releaseReservation,
  reserveInventory,
  updateInventory,
  // Error types
  LocationNotFoundError,
  StockroomCodeExistsError,
  StockroomHasDependenciesError,
  StockroomNameExistsError,
  StockroomNotFoundError,
} from './stockroom-service';

// Export bin location service functions
export {
  // Bin location CRUD operations
  createBinLocation,
  deactivateBinLocation,
  decrementBinLocationCount,
  deleteBinLocation,
  getActiveBinLocationsByStockroom,
  getBinLocation,
  getBinLocationByCode,
  getBinLocationOrThrow,
  getBinLocationsByStockroom,
  getBinLocationsAtCapacity,
  getBinLocationsWithAvailableCapacity,
  getBinLocationUtilizationSummary,
  incrementBinLocationCount,
  isBinCodeUnique,
  listBinLocations,
  updateBinLocation,
  updateBinLocationCount,
  // Error types
  BinCodeExistsError,
  BinLocationHasDependenciesError,
  BinLocationNotFoundError,
  StockroomNotFoundError as BinLocationStockroomNotFoundError,
} from './bin-location-service';

// Export repository functions for direct database access (internal use)
export {
  getStockroomById,
  getStockroomDependencies,
  locationExists,
  stockroomCodeExists,
  stockroomNameExistsInLocation,
} from './stockroom-repository';

// Export bin location repository functions for direct database access (internal use)
export {
  binCodeExistsInStockroom,
  getBinLocationById,
  getBinLocationDependencies,
  stockroomExists,
} from './bin-location-repository';

// Export types
export type {
  CreateInventoryRequest,
  CreateStockroomRequest,
  InventoryUpdateResult,
  LowStockItem,
  ProductType,
  ReplenishmentAlert,
  Stockroom,
  StockroomInventoryItem,
  StockroomListFilters,
  StockroomType,
  UpdateInventoryRequest,
  UpdateStockroomRequest,
} from './stockroom-service';

// Re-export bin location types from @ams/types
export type {
  BinLocation,
  BinLocationListFilters,
  CreateBinLocationRequest,
  UpdateBinLocationRequest,
} from '@ams/types';
