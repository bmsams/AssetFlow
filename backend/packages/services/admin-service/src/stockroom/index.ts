/**
 * Stockroom Admin module exports
 *
 * Provides stockroom administration operations including:
 * - Stockroom CRUD (Requirement 5): Create, read, update, deactivate stockrooms
 * - Bin/Shelf Location management (Requirement 6): Create, read, update, deactivate bin locations
 */

// Re-export types from @ams/types for convenience
export type {
  // Stockroom types
  Stockroom,
  StockroomType,
  CreateStockroomRequest,
  UpdateStockroomRequest,
  StockroomListFilters,
  // Bin location types
  BinLocation,
  CreateBinLocationRequest,
  UpdateBinLocationRequest,
  BinLocationListFilters,
} from '@ams/types';

// Service exports (public API)
export {
  createStockroom,
  getStockroom,
  updateStockroom,
  deactivateStockroom,
  listStockrooms,
  getActiveStockrooms,
  StockroomNotFoundError,
  StockroomHasDependenciesError,
} from './stockroom-service';

export {
  createBinLocation,
  getBinLocation,
  updateBinLocation,
  deactivateBinLocation,
  listBinLocations,
  getBinLocationsByStockroom,
  isBinCodeUnique,
  BinLocationNotFoundError,
  BinCodeExistsError,
} from './bin-location-service';
